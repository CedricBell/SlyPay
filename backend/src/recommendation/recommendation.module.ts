import { Module } from '@nestjs/common';
import { CategoryResolverService } from './category-resolver.service';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

@Module({
  controllers: [RecommendationController],
  providers: [RecommendationService, CategoryResolverService],
  exports: [RecommendationService, CategoryResolverService],
})
export class RecommendationModule {}
