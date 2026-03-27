import { withApiErrorHandling } from '../../../shared/lib/apiErrors';
import { withAuth } from '../../../shared/lib/auth';
import { handleScansApi } from '../../../shared/lib/apiHandlers';

export default withApiErrorHandling(withAuth(handleScansApi));
