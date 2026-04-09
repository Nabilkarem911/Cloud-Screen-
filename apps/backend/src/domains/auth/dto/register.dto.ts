import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsIn(['en', 'ar'])
  locale: 'en' | 'ar' = 'en';
}
