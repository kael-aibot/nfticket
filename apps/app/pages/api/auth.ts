import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { handleAuthApi } from '../../../shared/lib/apiHandlers';

export default withApiErrorHandling(handleAuthApi);
