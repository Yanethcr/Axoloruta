import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { IncomingMessage, ServerResponse } from 'node:http';
import { AccountService } from './account.service';

@Controller('auth')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}
  @Get('me') me(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    res.setHeader('Cache-Control', 'no-store');
    return { user: this.accounts.user(req) };
  }
  @Post('register') register(@Body() body: Record<string, unknown>, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    return this.accounts.authenticate(body ?? {}, true, req, res);
  }
  @Post('login') login(@Body() body: Record<string, unknown>, @Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) {
    return this.accounts.authenticate(body ?? {}, false, req, res);
  }
  @Post('logout') logout(@Req() req: IncomingMessage, @Res({ passthrough: true }) res: ServerResponse) { return this.accounts.logout(req, res); }
}
