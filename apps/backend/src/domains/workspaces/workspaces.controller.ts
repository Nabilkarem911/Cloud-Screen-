import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtUser } from '../../common/auth/current-user.decorator';
import { ClaimPairingSessionDto } from '../pairing/dto/claim-pairing-session.dto';
import { PairingService } from '../pairing/pairing.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly pairing: PairingService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.createForUser(user.sub, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Post('bootstrap-demo')
  bootstrapDemo(@CurrentUser() user: JwtUser) {
    return this.workspaces.bootstrapDemo(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post(':workspaceId/seed-demo')
  seedDemo(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.workspaces.seedDemoForMember(workspaceId, user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @Get(':workspaceId/members')
  members(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Patch(':workspaceId')
  updateWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.updateWorkspace(user.sub, workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete(':workspaceId')
  deleteWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.workspaces.deleteWorkspace(user.sub, workspaceId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post(':workspaceId/invites')
  invite(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaces.inviteDemo(workspaceId, dto.email, dto.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post(':workspaceId/pairing-sessions/claim')
  claimPairingSession(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ClaimPairingSessionDto,
  ) {
    return this.pairing.claimSession(workspaceId, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(204)
  @Post(':workspaceId/pairing-started')
  async notifyPairingStarted(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<void> {
    await this.workspaces.notifyPairingStarted(user.sub, workspaceId);
  }
}
