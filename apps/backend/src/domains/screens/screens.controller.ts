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
import { CreateScreenDto } from './dto/create-screen.dto';
import { ListScreensDto } from './dto/list-screens.dto';
import { RemoteCommandDto } from './dto/remote-command.dto';
import { OverrideScreenDto } from './dto/override-screen.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { ScreensService } from './screens.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('screens')
export class ScreensController {
  constructor(private readonly screensService: ScreensService) {}

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get()
  list(@Query() query: ListScreensDto) {
    return this.screensService.list(query);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post()
  create(@Body() dto: CreateScreenDto) {
    return this.screensService.create(dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post(':id/remote-command')
  remoteCommand(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: RemoteCommandDto,
  ) {
    return this.screensService.sendRemoteCommand(workspaceId, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get(':id/active-content')
  activeContent(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.screensService.getActiveContent(workspaceId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post(':id/override')
  setOverride(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: OverrideScreenDto,
  ) {
    return this.screensService.setPlaylistOverride(workspaceId, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get(':id')
  getById(@Param('id') id: string, @Query('workspaceId') workspaceId: string) {
    return this.screensService.getById(workspaceId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: UpdateScreenDto,
  ) {
    return this.screensService.update(workspaceId, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(204)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ): Promise<void> {
    await this.screensService.remove(workspaceId, id);
  }
}
