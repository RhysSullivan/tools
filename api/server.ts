import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { generateText } from "ai";
import pako from "pako";

const handler = createMcpHandler((server) => {
  server.tool(
    "roll_dice",
    "Rolls an N-sided die",
    { sides: z.number().int().min(2) },
    async ({ sides }) => {
      const value = 1 + Math.floor(Math.random() * sides);
      return {
        content: [{ type: "text", text: `🎲 You rolled a ${value}!` }],
      };
    },
  );
  server.tool(
    "get_weather",
    "Get the current weather at a location",
    {
      latitude: z.number(),
      longitude: z.number(),
      city: z.string(),
    },
    async ({ latitude, longitude, city }) => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,relativehumidity_2m&timezone=auto`,
      );
      const weatherData = await response.json();
      return {
        content: [
          {
            type: "text",
            text: `🌤️ Weather in ${city}: ${weatherData.current.temperature_2m}°C, Humidity: ${weatherData.current.relativehumidity_2m}%`,
          },
        ],
      };
    },
  );
  server.tool(
    "generate_amazon_fresh_link",
    "Convert a grocery list into an Amazon Fresh shopping link",
    {
      groceryList: z
        .string()
        .describe(
          "The grocery list to convert (items separated by newlines or commas)",
        ),
    },
    async ({ groceryList }) => {
      try {
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
            }),
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

        const result = JSON.stringify({
          url: amazonUrl,
          items: items,
        });

        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        const errorMessage = `Failed to convert grocery list: ${
          error instanceof Error ? error.message : String(error)
        }`;
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true,
        };
      }
    },
  );
});

export { handler as GET, handler as POST, handler as DELETE };
