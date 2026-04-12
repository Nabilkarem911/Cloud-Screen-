import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterStartDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  country!: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsIn(['en', 'ar'])
  locale: 'en' | 'ar' = 'en';
}
