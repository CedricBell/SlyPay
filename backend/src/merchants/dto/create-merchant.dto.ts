import { SpendCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class MerchantCategoryDto {
  @IsEnum(SpendCategory)
  category!: SpendCategory;
}

export class CreateMerchantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  mcc?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MerchantCategoryDto)
  categories?: MerchantCategoryDto[];
}
