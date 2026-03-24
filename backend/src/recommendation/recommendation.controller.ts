import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtUserPayload,
} from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { RecommendationService } from './recommendation.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class RecommendationController {
  constructor(private readonly recommendation: RecommendationService) {}

  @Post('recommendation')
  recommend(
    @CurrentUser() user: JwtUserPayload,
    @Body() dto: RecommendationRequestDto,
  ) {
    return this.recommendation.recommend(user.sub, dto);
  }

  @Get('recommendations')
  history(
    @CurrentUser() user: JwtUserPayload,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 30;
    return this.recommendation.history(user.sub, Number.isFinite(n) ? n : 30);
  }
}
