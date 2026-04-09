import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

/** Login accepts `admin` / `admin2` as shorthand for seeded accounts. */
export class LoginDto {
  @Transform(({ value }) => {
    const v = String(value ?? '').trim().toLowerCase();
    if (v === 'admin') return 'admin@cloudsignage.local';
    if (v === 'admin2') return 'admin2@client.local';
    return String(value ?? '').trim().toLowerCase();
  })
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  password!: string;
}
