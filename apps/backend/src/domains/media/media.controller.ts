import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { MediaService } from './media.service';

const MAX_BYTES = 150 * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('workspaceId') workspaceId: string,
    @Query('folderId') folderId?: string,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const created = await this.mediaService.saveUploadedFile({
      workspaceId,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      folderId: folderId ?? null,
    });
    return this.mediaService.toResponse(created);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.mediaService.list(workspaceId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ): Promise<void> {
    await this.mediaService.remove(workspaceId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get('folders/list')
  listFolders(@Query('workspaceId') workspaceId: string) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }
    return this.mediaService.listFolders(workspaceId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Post('folders')
  createFolder(
    @Query('workspaceId') workspaceId: string,
    @Body() body: { name?: string },
  ) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    if (!body?.name) throw new BadRequestException('name is required');
    return this.mediaService.createFolder(workspaceId, body.name);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Patch('folders/:id')
  renameFolder(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() body: { name?: string },
  ) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    if (!body?.name) throw new BadRequestException('name is required');
    return this.mediaService.renameFolder(workspaceId, id, body.name);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Delete('folders/:id')
  deleteFolder(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.mediaService.deleteFolder(workspaceId, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR)
  @Patch(':id/folder')
  moveMediaFolder(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() body: { folderId?: string | null },
  ) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required');
    return this.mediaService.moveMediaToFolder(
      workspaceId,
      id,
      body?.folderId ?? null,
    );
  }
}
