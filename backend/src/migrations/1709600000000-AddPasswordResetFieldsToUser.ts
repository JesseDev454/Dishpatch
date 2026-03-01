import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordResetFieldsToUser1709600000000 implements MigrationInterface {
  name = "AddPasswordResetFieldsToUser1709600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiresAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetRequestedAt" timestamptz`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetUsedAt" timestamptz`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_passwordResetTokenHash" ON "users" ("passwordResetTokenHash") WHERE "passwordResetTokenHash" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_passwordResetTokenHash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetUsedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetRequestedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetTokenExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordResetTokenHash"`);
  }
}
