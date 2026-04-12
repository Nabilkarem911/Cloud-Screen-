import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * Login accepts shorthand usernames for seeded dev accounts.
 * `require_tld: false` allows `.local` emails (validator.js rejects them by default).
 */
export class LoginDto {
  @Transform(({ value }) => {
    const v = String(value ?? '')
      .trim()
      .toLowerCase();
    if (v === 'admin' || v === 'superadmin' || v === 'super')
      return 'admin@cloudsignage.local';
    if (v === 'admin2' || v === 'client') return 'admin2@client.local';
    return String(value ?? '')
      .trim()
      .toLowerCase();
  })
  @IsEmail({ require_tld: false })
  email!: string;

  @IsString()
  @MinLength(3)
  password!: string;
}
