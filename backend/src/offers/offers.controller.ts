import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  JwtUserPayload,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { OffersService } from './offers.service';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(
    @CurrentUser() user: JwtUserPayload,
    @Query('cardId') cardId?: string,
  ) {
    return this.offers.list(user.sub, cardId);
  }

  @Post()
  create(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offers.create(user.sub, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    return this.offers.remove(user.sub, id);
  }
}
