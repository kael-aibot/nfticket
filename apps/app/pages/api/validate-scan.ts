import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { handleValidateScanApi } from '../../../shared/lib/scannerValidation';

export default withApiErrorHandling(handleValidateScanApi);
