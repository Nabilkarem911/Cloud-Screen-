import {
  BadRequestException,
  Controller,
  Delete,
  Get,
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
}
