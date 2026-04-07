import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { HealthModule } from './health/health.module';
import { MerchantsModule } from './merchants/merchants.module';
import { OffersModule } from './offers/offers.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    AdminModule,
    UsersModule,
    CardsModule,
    OffersModule,
    MerchantsModule,
    RecommendationModule,
    TransactionsModule,
  ],
})
export class AppModule {}
