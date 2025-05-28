import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PasswordCSVImporter, CredentialData } from "../services/csv-import.js";
import { ScreenshotService } from "../services/screenshot.js";
import { PasswordManagerDatabaseService } from "../database/service.js";
import { DatabaseConfig } from "../../../database/types.js";

// Database service instance
let dbService: PasswordManagerDatabaseService;

export async function passwordManagerRoutes(
  fastify: FastifyInstance,
  appDatabaseConfig?: DatabaseConfig
) {
  const csvImporter = new PasswordCSVImporter();
  const screenshotService = new ScreenshotService();

  // Initialize database service with app configuration or fallback to default
  if (appDatabaseConfig) {
    console.log(
      "🔐 Initializing password manager with application database configuration..."
    );
    dbService =
      PasswordManagerDatabaseService.createWithAppConfig(appDatabaseConfig);
  } else {
    console.log(
      "🔐 Initializing password manager with default SQLite configuration..."
    );
    dbService = new PasswordManagerDatabaseService();
  }

  await dbService.initialize();

  // CSV Upload endpoint
  fastify.post(
    "/password-manager/upload-csv",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = request.body as any;

        if (!data.csvContent) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "CSV content is required",
          });
        }

        const result = await csvImporter.importFromCSV(data.csvContent);
        const repository = dbService.getRepository();

        // Store imported credentials in database
        for (const credential of result.data) {
          await repository.create(credential);
        }

        return reply.send({
          success: true,
          result,
          message: `Imported ${result.imported} credentials, ${result.failed} failed`,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Get all credentials with enhanced filtering
  fastify.get(
    "/password-manager/credentials",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { category, importance, search, status } = request.query as any;
        const repository = dbService.getRepository();

        const filter = {
          category,
          importance: importance ? parseInt(importance) : undefined,
          status,
          search,
        };

        const credentials = await repository.findAll(filter);
        const categories = await repository.getCategories();
        const statuses = await repository.getStatuses();

        return reply.send({
          success: true,
          credentials,
          total: credentials.length,
          categories,
          statuses,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Get single credential by ID
  fastify.get(
    "/password-manager/credentials/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const repository = dbService.getRepository();

        const credential = await repository.findById(id);
        if (!credential) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Credential not found",
          });
        }

        return reply.send({
          success: true,
          credential,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Update credential
  fastify.put(
    "/password-manager/credentials/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const updates = request.body as Partial<CredentialData>;
        const repository = dbService.getRepository();

        const success = await repository.update(id, updates);
        if (!success) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Credential not found",
          });
        }

        const credential = await repository.findById(id);
        return reply.send({
          success: true,
          credential,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Capture screenshot for credential
  fastify.post(
    "/password-manager/credentials/:id/screenshot",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const repository = dbService.getRepository();

        const credential = await repository.findById(id);
        if (!credential) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Credential not found",
          });
        }

        const screenshot = await screenshotService.captureScreenshot(
          credential.url
        );
        const base64Screenshot = `data:image/png;base64,${screenshot.toString("base64")}`;

        // Update credential with screenshot
        await repository.update(id, { screenshot: base64Screenshot });

        return reply.send({
          success: true,
          screenshot: base64Screenshot,
          message: "Screenshot captured successfully",
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Screenshot Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to capture screenshot",
        });
      }
    }
  );

  // Find password change URL
  fastify.post(
    "/password-manager/credentials/:id/find-change-url",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const repository = dbService.getRepository();

        const credential = await repository.findById(id);
        if (!credential) {
          return reply.status(404).send({
            error: "Not Found",
            message: "Credential not found",
          });
        }

        const changeUrl = await screenshotService.findPasswordChangeUrl(
          credential.url
        );

        if (changeUrl) {
          await repository.update(id, { changePasswordUrl: changeUrl });
        }

        return reply.send({
          success: true,
          changePasswordUrl: changeUrl,
          message: changeUrl
            ? "Password change URL found"
            : "No password change URL found",
        });
      } catch (error) {
        return reply.status(500).send({
          error: "URL Search Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to find password change URL",
        });
      }
    }
  );

  // Get CSV template
  fastify.get(
    "/password-manager/csv-template",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const template = csvImporter.generateTemplate();

      return reply
        .header("Content-Type", "text/csv")
        .header(
          "Content-Disposition",
          'attachment; filename="password-template.csv"'
        )
        .send(template);
    }
  );

  // Bulk status update
  fastify.post(
    "/password-manager/bulk-status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { ids, status } = request.body as {
          ids: string[];
          status: "pending" | "processed" | "verified" | "changed" | "archived";
        };

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "IDs array is required",
          });
        }

        if (
          !status ||
          !["pending", "processed", "verified", "changed", "archived"].includes(
            status
          )
        ) {
          return reply.status(400).send({
            error: "Bad Request",
            message:
              "Valid status is required (pending, processed, verified, changed, archived)",
          });
        }

        const repository = dbService.getRepository();
        const updated = await repository.bulkUpdateStatus(ids, status);

        return reply.send({
          success: true,
          updated,
          message: `Updated status to '${status}' for ${updated} credentials`,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Bulk operations
  fastify.post(
    "/password-manager/bulk-screenshots",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { ids } = request.body as { ids?: string[] };
        const repository = dbService.getRepository();

        let targets: CredentialData[];
        if (ids) {
          targets = [];
          for (const id of ids) {
            const credential = await repository.findById(id);
            if (credential) {
              targets.push(credential);
            }
          }
        } else {
          targets = await repository.findAll();
        }

        if (targets.length === 0) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "No credentials found for screenshot capture",
          });
        }

        const results =
          await screenshotService.captureCredentialScreenshots(targets);

        // Update credentials with screenshots
        for (const result of results) {
          if (result.screenshot) {
            await repository.update(result.id, {
              screenshot: result.screenshot,
            });
          }
        }

        return reply.send({
          success: true,
          results,
          message: `Captured screenshots for ${results.filter((r) => r.screenshot).length}/${results.length} credentials`,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Bulk Screenshot Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to capture bulk screenshots",
        });
      }
    }
  );

  // Cleanup browser and database on shutdown
  fastify.addHook("onClose", async () => {
    await screenshotService.closeBrowser();
    if (dbService) {
      await dbService.close();
    }
  });
}
