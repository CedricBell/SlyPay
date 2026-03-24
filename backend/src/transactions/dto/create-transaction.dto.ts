import { SpendCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsEnum(SpendCategory)
  category?: SpendCategory;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  mcc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}
