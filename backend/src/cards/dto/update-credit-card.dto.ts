import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RewardRuleInputDto } from './reward-rule-input.dto';

export class UpdateCreditCardDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  issuer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  last4?: string;

  @IsOptional()
  @IsHexColor()
  colorHex?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** When provided, replaces all rules for the card */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardRuleInputDto)
  rules?: RewardRuleInputDto[];
}
