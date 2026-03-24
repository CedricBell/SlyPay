import { OfferStackPolicy, SpendCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateOfferDto {
  @IsString()
  creditCardId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsEnum(SpendCategory)
  category?: SpendCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  multiplier!: number;

  @IsOptional()
  @IsEnum(OfferStackPolicy)
  stackPolicy?: OfferStackPolicy;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validUntil!: string;
}
