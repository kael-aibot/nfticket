import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Nfticket } from "../target/types/nfticket";
import { expect } from "chai";

describe("NFTicket", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Nfticket as Program<Nfticket>;
  const provider = anchor.getProvider();
  const organizer = provider.wallet;
  let buyer: anchor.web3.Keypair;

  beforeEach(async () => {
    buyer = anchor.web3.Keypair.generate();
    const sig = await provider.connection.requestAirdrop(buyer.publicKey, anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
  });

  it("Creates an event", async () => {
    const eventName = "Test Concert";
    const [eventPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("event"), Buffer.from(eventName), organizer.publicKey.toBuffer()],
      program.programId
    );

    const tiers = [
      { name: "General", price: new anchor.BN(1000000), supply: 100, mintedCount: 0 },
      { name: "VIP", price: new anchor.BN(5000000), supply: 20, mintedCount: 0 },
    ];

    await program.methods
      .createEvent(eventName, "An amazing test concert", new anchor.BN(Date.now() / 1000 + 86400), "Test Venue", tiers, { organizerRoyalty: 10 })
      .accounts({ event: eventPda, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();

    const event = await program.account.event.fetch(eventPda);
    expect(event.name).to.equal(eventName);
    expect(event.tiers.length).to.equal(2);
    expect(event.isActive).to.be.true;
  });

  it("Mints a ticket with SOL payment", async () => {
    const eventName = "Mint Test Event";
    const [eventPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("event"), Buffer.from(eventName), organizer.publicKey.toBuffer()],
      program.programId
    );

    const tiers = [{ name: "General", price: new anchor.BN(1000000), supply: 100, mintedCount: 0 }];
    
    await program.methods.createEvent(eventName, "Description", new anchor.BN(Date.now() / 1000 + 86400), "Venue", tiers, { organizerRoyalty: 10 })
      .accounts({ event: eventPda, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();

    const eventAccount = await program.account.event.fetch(eventPda);
    const [ticketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), eventPda.toBuffer(), buyer.publicKey.toBuffer(), Buffer.from(new anchor.BN(eventAccount.totalTicketsSold).toArray("le", 4))],
      program.programId
    );

    const organizerBalanceBefore = await provider.connection.getBalance(organizer.publicKey);

    await program.methods.mintTicket(0)
      .accounts({ event: eventPda, ticket: ticketPda, buyer: buyer.publicKey, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([buyer])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda);
    expect(ticket.owner.toBase58()).to.equal(buyer.publicKey.toBase58());
    expect(ticket.purchasePrice.toNumber()).to.equal(1000000);

    const organizerBalanceAfter = await provider.connection.getBalance(organizer.publicKey);
    expect(organizerBalanceAfter).to.be.greaterThan(organizerBalanceBefore);
  });

  it("Handles resale with royalty split", async () => {
    const eventName = "Resale Test Event";
    const [eventPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("event"), Buffer.from(eventName), organizer.publicKey.toBuffer()],
      program.programId
    );

    const tiers = [{ name: "General", price: new anchor.BN(1000000), supply: 100, mintedCount: 0 }];
    
    await program.methods.createEvent(eventName, "Desc", new anchor.BN(Date.now() / 1000 + 86400), "Venue", tiers, { organizerRoyalty: 10 })
      .accounts({ event: eventPda, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();

    const eventAccount = await program.account.event.fetch(eventPda);
    const [ticketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), eventPda.toBuffer(), buyer.publicKey.toBuffer(), Buffer.from(new anchor.BN(eventAccount.totalTicketsSold).toArray("le", 4))],
      program.programId
    );

    await program.methods.mintTicket(0)
      .accounts({ event: eventPda, ticket: ticketPda, buyer: buyer.publicKey, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([buyer])
      .rpc();

    await program.methods.listForResale(new anchor.BN(2000000))
      .accounts({ ticket: ticketPda, owner: buyer.publicKey })
      .signers([buyer])
      .rpc();

    const newBuyer = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(newBuyer.publicKey, anchor.web3.LAMPORTS_PER_SOL * 2);

    await program.methods.buyResaleTicket()
      .accounts({ event: eventPda, ticket: ticketPda, buyer: newBuyer.publicKey, seller: buyer.publicKey, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([newBuyer])
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda);
    expect(ticket.owner.toBase58()).to.equal(newBuyer.publicKey.toBase58());
  });

  it("Scans ticket as organizer", async () => {
    const eventName = "Scan Test Event";
    const [eventPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("event"), Buffer.from(eventName), organizer.publicKey.toBuffer()],
      program.programId
    );

    const tiers = [{ name: "General", price: new anchor.BN(1000000), supply: 100, mintedCount: 0 }];
    
    await program.methods.createEvent(eventName, "Desc", new anchor.BN(Date.now() / 1000 + 86400), "Venue", tiers, { organizerRoyalty: 10 })
      .accounts({ event: eventPda, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();

    const eventAccount = await program.account.event.fetch(eventPda);
    const [ticketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), eventPda.toBuffer(), buyer.publicKey.toBuffer(), Buffer.from(new anchor.BN(eventAccount.totalTicketsSold).toArray("le", 4))],
      program.programId
    );

    await program.methods.mintTicket(0)
      .accounts({ event: eventPda, ticket: ticketPda, buyer: buyer.publicKey, organizer: organizer.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .signers([buyer])
      .rpc();

    await program.methods.scanTicket()
      .accounts({ event: eventPda, ticket: ticketPda, scanner: organizer.publicKey })
      .rpc();

    const ticket = await program.account.ticket.fetch(ticketPda);
    expect(ticket.scanStatus.scanned).to.not.be.undefined;
  });
});
