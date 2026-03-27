import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { handleScannerTokenApi } from '../../../shared/lib/scannerValidation';

export default withApiErrorHandling(handleScannerTokenApi);
