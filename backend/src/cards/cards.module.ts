import { Module } from '@nestjs/common';
import { CardCatalogService } from './card-catalog.service';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  controllers: [CardsController],
  providers: [CardsService, CardCatalogService],
  exports: [CardsService],
})
export class CardsModule {}
