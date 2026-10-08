import { Module } from '@nestjs/common';
import { CarsController } from './cars/cars.controller';
import { HealthController } from './health.controller';
import { OcmController } from './ocm/ocm.controller';
import { OcmService } from './ocm/ocm.service';
import { AccountService } from './account/account.service';
import { AccountController } from './account/account.controller';

@Module({
  controllers: [HealthController, CarsController, OcmController, AccountController],
  providers: [OcmService, AccountService],
})
export class AppModule {}
