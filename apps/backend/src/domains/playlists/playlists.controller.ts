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
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { RenamePlaylistDto } from './dto/rename-playlist.dto';
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
  rename(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: RenamePlaylistDto,
  ) {
    return this.playlistsService.rename(workspaceId, id, dto.name);
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
  ): Promise<void> {
    await this.playlistsService.remove(workspaceId, id);
  }
}
