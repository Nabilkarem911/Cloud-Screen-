import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
