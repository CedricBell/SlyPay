import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtUserPayload,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CardCatalogService } from './card-catalog.service';
import { CardsService } from './cards.service';
import { CreateCreditCardDto } from './dto/create-credit-card.dto';
import { UpdateCreditCardDto } from './dto/update-credit-card.dto';

@Controller('cards')
@UseGuards(JwtAuthGuard)
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly catalog: CardCatalogService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.cards.list(user.sub);
  }

  /** Autocomplete for add-card flow — must stay above GET :id */
  @Get('catalog/suggestions')
  catalogSuggestions(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 12;
    return this.catalog.search(q ?? '', Number.isFinite(n) ? n : 12);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.cards.get(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateCreditCardDto,
  ) {
    return this.cards.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCreditCardDto,
  ) {
    return this.cards.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.cards.remove(user.sub, id);
  }
}
