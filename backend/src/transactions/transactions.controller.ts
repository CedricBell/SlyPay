import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtUserPayload,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly tx: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtUserPayload,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.tx.list(user.sub, Number.isFinite(n) ? n : 50);
  }

  @Post()
  create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.tx.create(user.sub, dto);
  }
}
