import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/auth/super-admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtUser } from '../../common/auth/current-user.decorator';
import { setAuthCookies } from '../auth/auth-cookie.util';
import { AdminService } from './admin.service';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { ImpersonateUserDto } from './dto/impersonate-user.dto';
import { CreateCustomerWorkspaceDto } from './dto/create-customer-workspace.dto';
import { UpdateCustomerWorkspaceDto } from './dto/update-customer-workspace.dto';
import { PatchCustomerSubscriptionDto } from './dto/patch-customer-subscription.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { BrandingAssetsService } from './branding-assets.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly brandingAssets: BrandingAssetsService,
  ) {}

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('staff')
  listStaff() {
    return this.adminService.listStaff();
  }

  @Post('staff')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.adminService.createStaff(dto);
  }

  @Patch('staff/:id/role')
  updateStaffRole(@Param('id') id: string, @Body() dto: UpdateStaffRoleDto) {
    return this.adminService.updateStaffRole(id, dto.adminRole);
  }

  @Get('customers')
  listCustomers(
    @Query('q') q?: string,
    @Query('filter') filter?: 'all' | 'active' | 'expired' | 'trial',
  ) {
    return this.adminService.listCustomers(q, filter ?? 'all');
  }

  @Get('customers/:customerId/workspaces/:workspaceId')
  getCustomerWorkspaceDetail(
    @Param('customerId') customerId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.adminService.getCustomerWorkspaceDetail(customerId, workspaceId);
  }

  @Get('customers/:id')
  getCustomer(@Param('id') id: string) {
    return this.adminService.getCustomerProfile(id);
  }

  @Post('customers/:id/workspaces')
  createCustomerWorkspace(
    @Param('id') id: string,
    @Body() dto: CreateCustomerWorkspaceDto,
  ) {
    return this.adminService.createCustomerWorkspace(id, dto.name);
  }

  @Patch('customers/:customerId/workspaces/:workspaceId')
  updateCustomerWorkspace(
    @Param('customerId') customerId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateCustomerWorkspaceDto,
  ) {
    return this.adminService.updateCustomerWorkspace(
      customerId,
      workspaceId,
      dto.name,
    );
  }

  @Delete('customers/:customerId/workspaces/:workspaceId')
  deleteCustomerWorkspace(
    @Param('customerId') customerId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.adminService.deleteCustomerWorkspace(customerId, workspaceId);
  }

  @Patch('customers/:id/subscription')
  patchCustomerSubscription(
    @Param('id') id: string,
    @Body() dto: PatchCustomerSubscriptionDto,
  ) {
    return this.adminService.patchCustomerSubscription(id, dto);
  }

  @Post('customers/:id/reminder')
  sendReminder(@Param('id') id: string) {
    return this.adminService.sendSubscriptionReminder(id);
  }

  @Get('workspaces')
  listWorkspaces() {
    return this.adminService.listWorkspaces();
  }

  @Get('stats')
  globalStats() {
    return this.adminService.getGlobalStats();
  }

  @Get('logs')
  logs() {
    return this.adminService.listLogs();
  }

  @Get('settings')
  settings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  patchSettings(@Body() dto: UpdateAdminSettingsDto) {
    return this.adminService.patchSettings(dto);
  }

  @Post('settings/branding/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadBrandingLogo(
    @Query('variant') variant: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.brandingAssets.uploadVariant(variant, file);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminService.updateUser(user.sub, id, dto);
  }

  @Post('users/:id/impersonate')
  async impersonate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: ImpersonateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminService.impersonateUser(
      user.sub,
      id,
      body.workspaceId,
    );
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return {
      accessToken: result.accessToken,
      user: result.user,
      workspaces: result.workspaces,
    };
  }
}
