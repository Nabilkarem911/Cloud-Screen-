import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailChangeDto {
  @IsEmail()
  newEmail!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
