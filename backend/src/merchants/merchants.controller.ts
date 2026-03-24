import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { MerchantsService } from './merchants.service';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get()
  search(@Query('q') q?: string) {
    return this.merchants.search(q ?? '', 25);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateMerchantDto) {
    return this.merchants.create(dto);
  }
}
