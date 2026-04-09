import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCustomerWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
