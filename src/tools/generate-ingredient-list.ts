import { tool } from "@opencode-ai/plugin";
import { generateText } from "ai";
import pako from "pako";

export default tool({
  description: "Convert a grocery list into an Amazon Fresh shopping link",
  args: {
    groceryList: tool.schema
      .string()
      .describe(
        "The grocery list to convert (items separated by newlines or commas)"
      ),
  },
  async execute(args) {
    try {
      const { groceryList } = args;

      if (!groceryList || typeof groceryList !== "string") {
        throw new Error("Invalid grocery list provided");
      }

      const { text } = await generateText({
        model: "openai/gpt-4o-mini",
        prompt: `Parse this grocery list and return ONLY a JSON array of objects with "name", "amount", and "unit" fields.
      
      Rules:
      - Extract the quantity as a number for "amount" (default to 1 if not specified)
      - Map the unit to one of these UPPERCASE values: COUNT, CUPS, TABLESPOONS, TEASPOONS, GRAMS, MILLILITERS, OUNCES, POUNDS, LITERS
      - If no unit is specified or it's just "items", use "COUNT"
      - Be concise with item names
      
      Examples:
      "2 cups of milk" → {"name": "Milk", "amount": 2, "unit": "CUPS"}
      "butter" → {"name": "Butter", "amount": 1, "unit": "COUNT"}
      "500g flour" → {"name": "Flour", "amount": 500, "unit": "GRAMS"}
      
      Grocery list:
      ${groceryList}
      
      Return ONLY the JSON array, no other text.`,
      });

      // Parse the AI response
      let items;
      try {
        items = JSON.parse(text.trim());
      } catch {
        // Fallback: simple line-by-line parsing
        items = groceryList
          .split(/[\n,]/)
          .map((item: string) => item.trim())
          .filter((item: string) => item.length > 0)
          .map((item: string) => ({
            name: item,
            amount: 1,
            unit: "COUNT",
          }));
      }

      const ingredientsData = {
        ingredients: items.map(
          (item: { name: string; amount: number; unit: string }) => ({
            name: item.name,
            optional: false,
            quantityList: [
              {
                unit: item.unit,
                amount: item.amount,
              },
            ],
          })
        ),
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(ingredientsData);

      // Compress using gzip
      const compressed = pako.gzip(jsonString);

      const base64Encoded = Buffer.from(compressed)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      // URL encode the base64url string
      const urlEncoded = encodeURIComponent(base64Encoded);

      // Construct the Amazon Fresh URL
      const amazonUrl = `https://www.amazon.com/afx/ingredients/landingencoded?almBrandId=QW1hem9uIEZyZXNo&encodedIngredients=${urlEncoded}&tag=`;

      return JSON.stringify({
        url: amazonUrl,
        items: items,
      });
    } catch (error) {
      throw new Error(
        `Failed to convert grocery list: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
