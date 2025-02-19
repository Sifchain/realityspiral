import express, { Router } from "express";
import {
    getTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    batchUpdateCharacterData,
} from '../controllers/templateController';

const router: Router = express.Router();

/** ========================== Templates API ========================== **/

/**
 * @swagger
 * /api/templates/{characterName}:
 *   get:
 *     summary: Get all prompt templates for a character
 *     description: Retrieves all saved prompt templates for the specified character.
 *     parameters:
 *       - in: path
 *         name: characterName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the character.
 *     responses:
 *       200:
 *         description: Returns a list of all templates.
 *       404:
 *         description: Character not found.
 */
router.post("/:characterName", async (req, res) => {
    getTemplates(req, res)
});


/**
 * @swagger
 * /api/templates/{characterName}:
 *   post:
 *     summary: Add a new prompt template
 *     description: Creates a new prompt template and stores it in the character's JSON file.
 *     parameters:
 *       - in: path
 *         name: characterName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the character.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateName:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Template added successfully.
 *       400:
 *         description: Invalid request body.
 *       404:
 *         description: Character not found.
 */
router.post("/:characterName", async (req, res) => {
    addTemplate(req, res)
});

/**
 * @swagger
 * /api/templates/{characterName}:
 *   put:
 *     summary: Update an existing template
 *     description: Modifies an existing template in the character JSON file.
 *     parameters:
 *       - in: path
 *         name: characterName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the character.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateName:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Template updated successfully.
 *       404:
 *         description: Template or character not found.
 */
router.post("/:characterName", async (req, res) => {
    updateTemplate(req, res)
});

/**
 * @swagger
 * /api/templates/{characterName}/{templateName}:
 *   delete:
 *     summary: Delete a template
 *     description: Removes a prompt template from the character's JSON file.
 *     parameters:
 *       - in: path
 *         name: characterName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the character.
 *       - in: path
 *         name: templateName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the template to delete.
 *     responses:
 *       200:
 *         description: Template deleted successfully.
 *       404:
 *         description: Template or character not found.
 */
router.post("/:characterName/:templateName", async (req, res) => {
    deleteTemplate(req, res)
});

/** ========================== Batch Update API ========================== **/

/**
 * @swagger
 * /api/templates/{characterName}/batch-update:
 *   put:
 *     summary: Batch update character data
 *     description: Updates templates, lore, bio, and knowledge in a single API call.
 *     parameters:
 *       - in: path
 *         name: characterName
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the character.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templates:
 *                 type: object
 *                 description: Templates to add or update.
 *               lore:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lore entries to append.
 *               bio:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Bio entries to append.
 *               knowledge:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Knowledge entries to append.
 *     responses:
 *       200:
 *         description: Character data updated successfully.
 *       400:
 *         description: No valid updates provided.
 *       404:
 *         description: Character not found.
 */
router.post("/:characterName/batch-update", async (req, res) => {
    batchUpdateCharacterData(req, res)
});

export default router;
