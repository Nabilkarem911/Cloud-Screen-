import { IsIn } from 'class-validator';

export class UpdateStaffRoleDto {
  @IsIn(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'])
  adminRole!: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER';
}