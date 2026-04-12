import { IsEmail } from 'class-validator';

export class RegisterResendDto {
  @IsEmail()
  email!: string;
}
