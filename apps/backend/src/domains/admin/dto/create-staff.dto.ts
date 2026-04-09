import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'])
  adminRole!: 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'VIEWER';
}