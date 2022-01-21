import { logger } from "firebase-functions";
import * as functions from "firebase-functions";
import { v4 as uuidv4 } from "uuid";
import {
  Collections,
  ImageComposite,
  ImageComposites,
  TraitValuePair,
} from "../models/models";

export class RarityGenerator {
  projectId: string;
  collectionId: string;
  compositeGroupId: string;

  constructor(
    projectId: string,
    collectionId: string,
    compositeGroupId: string
  ) {
    this.projectId = projectId;
    this.collectionId = collectionId;
    this.compositeGroupId = compositeGroupId;
  }

  async generate(): Promise<(ImageComposite | null)[]> {
    const collection = await Collections.withId(
      this.collectionId,
      this.projectId
    );

    logger.info(
      "Generate Rarity for project: " +
        this.projectId +
        " collection: " +
        collection.name +
        "(" +
        this.collectionId +
        ")"
    );

    const legendaryCount = Number.parseInt(functions.config().rank.legendary);
    const rareCount = Number.parseInt(functions.config().rank.rare);
    const uncommonCount = Number.parseInt(functions.config().rank.uncommon);

    logger.info(`Legendary count: ${legendaryCount}`);
    logger.info(`Rare count: ${rareCount}`);
    logger.info(`Uncommon count: ${uncommonCount}`);

    if (legendaryCount > rareCount) {
      logger.warn(
        `Legendary count ${legendaryCount} is greater than Rare count ${rareCount}`
      );
      return [];
    }
    if (rareCount > uncommonCount) {
      logger.warn(
        `Rare count ${rareCount} is greater than Uncommon count ${uncommonCount}`
      );
      return [];
    }

    const composites = await ImageComposites.all(
      this.projectId,
      this.collectionId,
      this.compositeGroupId
    );

    // sort by rarity
    composites.sort(
      (a, b) => this.calculateRarity(a.traits) - this.calculateRarity(b.traits)
    );

    const rankTrait = {
      id: uuidv4(),
      name: "Rank",
      zIndex: 99,
      traitSetIds: [],
      isMetadataOnly: true,
      isArtworkOnly: false,
      isAlwaysUnique: false,
      excludeFromDuplicateDetection: true,
    };

    // update composites with rank trait
    return await Promise.all(
      composites.map(async (c, i) => {
        let rankValue = "";

        if (i < legendaryCount) {
          rankValue = "Legendary";
        } else if (i < legendaryCount + rareCount) {
          rankValue = "Rare";
        } else if (i < legendaryCount + rareCount + uncommonCount) {
          rankValue = "Uncommon";
        } else {
          rankValue = "Common";
        }

        return await ImageComposites.update(
          {
            ...c,
            traits: [
              ...c.traits,
              {
                trait: rankTrait,
                traitValue: {
                  id: uuidv4(),
                  name: rankValue,
                  rarity: 1,
                },
                imageLayer: null,
              },
            ],
          },
          this.projectId,
          this.collectionId,
          this.compositeGroupId
        );
      })
    );
  }

  calculateRarity = (traits: TraitValuePair[]) =>
    traits
      .filter((t) => t.traitValue)
      .map((t) => t.traitValue!.rarity)
      .reduce((totalValue, currentValue) => {
        return totalValue * currentValue;
      }, 1) * 100;
}
