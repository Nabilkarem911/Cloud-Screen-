import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.schedulesService.list(workspaceId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get('overlaps')
  overlaps(@Query('workspaceId') workspaceId: string) {
    return this.schedulesService.listOverlaps(workspaceId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get(':id')
  getOne(@Param('id') id: string, @Query('workspaceId') workspaceId: string) {
    return this.schedulesService.getOne(workspaceId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post()
  create(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(workspaceId, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(204)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ): Promise<void> {
    await this.schedulesService.remove(workspaceId, id);
  }
}
