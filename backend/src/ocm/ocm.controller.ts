import { Controller, Get, Req } from '@nestjs/common';
import { IncomingMessage } from 'node:http';
import { AccountService } from '../account/account.service';
import { OcmService } from './ocm.service';

@Controller('ocm')
export class OcmController {
  constructor(private readonly ocm: OcmService, private readonly accounts: AccountService) {}

  /** Cargadores en el área de CDMX (Open Charge Map u OpenStreetMap). */
  @Get()
  list(@Req() req: IncomingMessage) {
    this.accounts.requireUser(req);
    return this.ocm.list();
  }
}
