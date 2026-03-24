import { EarningType, SpendCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RewardRuleInputDto {
  @IsEnum(SpendCategory)
  category!: SpendCategory;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000)
  multiplier!: number;

  @IsOptional()
  @IsEnum(EarningType)
  earningType?: EarningType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capAmountMonthly?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
