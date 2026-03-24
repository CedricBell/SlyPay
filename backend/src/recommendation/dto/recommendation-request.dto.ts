import { SpendCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RecommendationRequestDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  merchantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  mcc?: string;

  @IsOptional()
  @IsEnum(SpendCategory)
  categoryHint?: SpendCategory;

  /** Persist row for analytics / debugging (default true) */
  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
