import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUserPayload = { sub: string; email: string };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUserPayload;
  },
);
