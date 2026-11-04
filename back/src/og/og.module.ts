import { Module } from '@nestjs/common';
import { OgController } from './og.controller.js';
import { OgService } from './og.service.js';

@Module({ controllers: [OgController], providers: [OgService] })
export class OgModule {}
