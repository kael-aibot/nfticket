-- Add supporting indexes for common query paths.
CREATE INDEX "UserIdentity_role_createdAt_idx" ON "UserIdentity"("role", "createdAt");
CREATE INDEX "UserIdentity_kycStatus_createdAt_idx" ON "UserIdentity"("kycStatus", "createdAt");

CREATE INDEX "Event_organizerId_startsAt_idx" ON "Event"("organizerId", "startsAt");
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

CREATE INDEX "Order_eventId_createdAt_idx" ON "Order"("eventId", "createdAt");
CREATE INDEX "Order_purchaserId_createdAt_idx" ON "Order"("purchaserId", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_paymentReference_idx" ON "Order"("paymentReference");

CREATE INDEX "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");
CREATE INDEX "Ticket_ownerId_createdAt_idx" ON "Ticket"("ownerId", "createdAt");
CREATE INDEX "Ticket_inventoryKey_idx" ON "Ticket"("inventoryKey");

CREATE INDEX "Payout_eventId_status_createdAt_idx" ON "Payout"("eventId", "status", "createdAt");
CREATE INDEX "Payout_orderId_idx" ON "Payout"("orderId");

CREATE INDEX "Scan_eventId_scannedAt_idx" ON "Scan"("eventId", "scannedAt");
CREATE INDEX "Scan_ticketId_scannedAt_idx" ON "Scan"("ticketId", "scannedAt");
CREATE INDEX "Scan_scannerUserId_scannedAt_idx" ON "Scan"("scannerUserId", "scannedAt");

CREATE INDEX "ScanAttempt_eventId_createdAt_idx" ON "ScanAttempt"("eventId", "createdAt");
CREATE INDEX "ScanAttempt_ticketId_createdAt_idx" ON "ScanAttempt"("ticketId", "createdAt");
CREATE INDEX "ScanAttempt_scannerUserId_createdAt_idx" ON "ScanAttempt"("scannerUserId", "createdAt");
CREATE INDEX "ScanAttempt_result_createdAt_idx" ON "ScanAttempt"("result", "createdAt");
