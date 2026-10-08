import { Controller, Get } from '@nestjs/common';
import { CARS } from './cars';

@Controller('cars')
export class CarsController {
  /** Catálogo de autos con su batería y potencia de carga. */
  @Get()
  list() {
    return CARS;
  }
}
