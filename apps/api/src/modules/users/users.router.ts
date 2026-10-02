import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { UserRole } from '@campuspulse/shared';
import { createUserSchema, updateUserRolesSchema } from './users.schema';

const router = Router();

// Platform administration: creating users and assigning roles is owner-only.
router.use(authenticate);
router.use(authorize([UserRole.PLATFORM_OWNER]));

router.get('/roles', UsersController.getRoles);
router.get('/', UsersController.getUsers);
router.post('/', validate(createUserSchema), UsersController.createUser);
router.patch('/:id/roles', validate(updateUserRolesSchema), UsersController.updateUserRoles);

export const usersRouter: Router = router;