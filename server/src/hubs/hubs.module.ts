import { Module, Global } from '@nestjs/common';
import { HrmsGateway } from './hrms.gateway';
import { AuthModule } from '../modules/auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  providers: [HrmsGateway],
  exports: [HrmsGateway],
})
export class HubsModule {}
