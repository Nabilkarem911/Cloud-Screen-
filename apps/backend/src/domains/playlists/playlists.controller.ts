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
import { CurrentUser, type JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ClonePlaylistDto } from './dto/clone-playlist.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { ReplacePlaylistItemsDto } from './dto/replace-playlist-items.dto';
import { PlaylistsService } from './playlists.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.playlistsService.list(workspaceId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get(':id')
  getOne(@Param('id') id: string, @Query('workspaceId') workspaceId: string) {
    return this.playlistsService.getOne(workspaceId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post()
  create(@Body() dto: CreatePlaylistDto) {
    return this.playlistsService.create(dto.workspaceId, dto.name);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(workspaceId, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post(':id/duplicate')
  duplicate(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.playlistsService.duplicateInWorkspace(workspaceId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post(':id/clone-to-workspace')
  cloneToWorkspace(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: ClonePlaylistDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.playlistsService.cloneToWorkspace(
      user.sub,
      workspaceId,
      id,
      dto.targetWorkspaceId,
    );
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Patch(':id/items')
  replaceItems(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: ReplacePlaylistItemsDto,
  ) {
    return this.playlistsService.replaceItems(workspaceId, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(204)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Query('force') force?: string,
  ): Promise<void> {
    await this.playlistsService.remove(workspaceId, id, {
      force: force === 'true' || force === '1',
    });
  }
}
