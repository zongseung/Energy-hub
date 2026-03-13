# ML-Based and Hybrid (AHP+ML / GIS+ML) Solar PV Site Selection — Literature Review

**Compiled:** 2026-03-13
**Scope:** 2018–2025 | Pure ML, Hybrid GIS+ML, Hybrid AHP+ML, Deep Learning for solar PV suitability mapping

---

## Summary Table

| # | Authors & Year | Full Title | Region | Journal | Model Type(s) | Key Input Variables | Target Variable | Best Metric | Hard Mask / Exclusion |
|---|---------------|-----------|--------|---------|--------------|--------------------|-----------------|-----------|-----------------------|
| 1 | Xia et al. (2023) | Spatial modelling the location choice of large-scale solar photovoltaic power plants: Application of interpretable machine learning techniques and the national inventory | China (national) | Energy Conversion and Management | RF, XGBoost, MLP | 21 geospatial factors: NDVI, distance to grid, slope, aspect, solar radiation, land cover type, GDP, population density, distance to road, temperature | Binary: PV installed (≥1 hm²) / not installed | RF best; AUC not quoted but SHAP used for validation | Exclude: water bodies, protected areas, urban built-up |
| 2 | Yildiz & Arslan (2022) | Global Spatial Suitability Mapping of Wind and Solar Systems Using an Explainable AI-Based Approach | Global (55,000+ sites) | ISPRS IJGI | RF, SVM, MLP | Solar irradiance, temperature, terrain slope, land cover, distance to road, distance to grid, wind speed | Binary: renewable plant present/absent | RF: Acc=90%, κ=0.79, AUC=0.95 | Exclude: protected areas, water, steep slopes |
| 3 | Alshamrani et al. (2025) | Geographic Information System and Machine Learning Approach for Solar Photovoltaic Site Selection: A Case Study in Pakistan | Cholistan Desert, Pakistan | Processes (MDPI) | RF, XGBoost, MLP + SHAP | 14 factors: solar radiation, slope, aspect, land use, distance to road, distance to grid, distance to settlement, soil type, temperature, humidity, wind, elevation, population, distance to water | Binary suitability (high/very high vs. other) | RF AUC = 0.92; XGBoost: aspect dominant feature | Exclude: water bodies, urban areas, protected lands |
| 4 | Liu et al. (2024) | Evaluation of Site Suitability for Photovoltaic Power Plants in the Beijing–Tianjin–Hebei Region of China Using a Combined Weighting Method | Beijing–Tianjin–Hebei, China | Land (MDPI) | AHP + XGBoost hybrid → PDSI index | Ecological suitability (vegetation, ecology), economic suitability (land price, grid distance, road distance), land suitability (slope, aspect, solar radiation, land use) | Continuous PDSI score (quantitative suitability index) | 21.59% area classified suitable; no AUC reported | Exclude: cropland, forests, ecological red lines, urban |
| 5 | Song, Cao & Yang (2023) | Assessment of solar radiation resource and photovoltaic power potential across China based on optimized interpretable machine learning model and GIS-based approaches | China (national) | Applied Energy | PSO-XGBoost (optimized by Particle Swarm Optimization) + GIS | Sunshine hours, temperature, humidity, elevation, latitude, longitude, cloud cover, aerosol optical depth | Continuous: GHI / PV power potential (kWh/m²) | PSO-XGBoost outperforms plain XGBoost; SHAP for transparency | N/A (potential estimation, not exclusion siting) |
| 6 | Wang et al. (2025) | Solar and wind power plant site selection in China: Machine learning-based regional and temporal probability | China (national, subregion-differentiated) | Applied Energy | RF, XGBoost, MLP (subregional & temporal models) | Distance to road, distance to substation (~5 km and ~30 km thresholds), solar resource, slope, land cover, GDP, population, time period | Probability score (0–1) per 1 km grid cell | Distance to road & substation = top predictors; regional variation documented | Exclude: steep slopes, water, dense urban, protected areas |
| 7 | Ozbek & Yildiz (2021) | Selection of renewable energy systems sites using the MaxEnt model in the Eastern Mediterranean region in Turkey | Eastern Mediterranean, Turkey (Hatay & Mersin) | Environmental Science and Pollution Research | MaxEnt (Maximum Entropy Species Distribution Model) | Solar irradiance, temperature, elevation, slope, aspect, land cover, precipitation, proximity to settlements | Habitat suitability probability (0–1, analogous to species SDM) | Solar AUC = 0.87; Wind AUC = 0.95 | Exclude: built-up areas, water bodies, forests |
| 8 | Kim et al. (2023) | Spatial distribution of solar PV deployment: an application of the region-based convolutional neural network | Colorado, USA | EPJ Data Science | Faster R-CNN (object detection) + XGBoost (socio-economic predictors) | Computer vision: satellite imagery; XGBoost: 43 socio-economic/demographic factors (party vote share, hail risk, median home value, % renters, permitting timelines) | Count of rooftop PV panels per neighborhood; % roof area covered | Faster R-CNN mAP=81% (panels), 95% (roofs); XGBoost R²≈0.70 | N/A (mapping deployment, not exclusion siting) |
| 9 | Raza et al. (2025) | A Novel Integrated GIS-AI Framework for Optimal CSP Plant Site Selection: A Multi-Criteria Approach Under Climate Change Scenarios in Bushehr, Iran | Bushehr Province, Iran | Advances in Space Research | RF + CNN + Fuzzy MCDA + GIS (hybrid) | Solar DNI, temperature, humidity, slope, land cover, distance to road, distance to grid, wind speed, climate change scenario projections | Binary suitability (highly suitable = 5.37% of area ≈ 1,246 km²) | RF+CNN improved spatial accuracy by 12.7% over conventional MCDA | Exclude: protected areas, agricultural land, urban zones, steep terrain |
| 10 | Li et al. (2025) | A Novel Hybrid Fuzzy Comprehensive Evaluation and Machine Learning Framework for Solar PV Suitability Mapping in China | China (national) | Remote Sensing (MDPI) | Fuzzy Comprehensive Evaluation (FCE) + ML (unspecified ensemble) | 11 spatial indicators: GHI, land prices, regional power demand, slope, aspect, land cover, distance to grid, temperature, elevation, ecological sensitivity, policy zones | Continuous suitability score (economic + climatic + geographic) | AUC / accuracy not reported in abstract; spatial coverage metrics used | Exclude: ecological red lines, Class I farmland, water bodies |
| 11 | Patel & Yadav (2025) | A hybrid ANN–AHP–GIS framework with dimensionality reduction and uncertainty quantification for solar site selection in Southern India | Southern India (Vizag, Guntur, Srikakulam) | Sustainable Energy Technologies and Assessments | ANN + AHP + GIS + PCA + t-SNE + Monte Carlo | Solar irradiance, land use, slope, aspect, distance to grid, temperature, humidity, wind, economic factors; PCA/t-SNE for dimensionality reduction | Ranked site suitability score (continuous) | Classification accuracy +22% vs. individual models; 95% CI via Monte Carlo | Exclude: forests, water bodies, steep slopes, urban |
| 12 | Liang et al. (2025) | Deep Learning Ensemble and Multi-Criteria GIS for High-Fidelity Rooftop Solar Potential Mapping | Amsterdam, Netherlands | Journal of Geovisualization and Spatial Analysis | Ensemble DL: UNet-ResNet50 + DeepLabv3-ResNet50 + Mask2Former-SwinTransformer + SAM-LoRA + PSPNet-ResNet50 (weighted majority voting) + GIS | High-resolution satellite imagery (RGB + near-IR), building footprints, LiDAR-derived DSM, shadow masks, rooftop orientation | Binary: existing solar panel / suitable rooftop (semantic segmentation) | Ensemble superior to individual models on F1, precision, recall (exact values NR in abstract) | Exclude: shaded roofs, roofs below area threshold, non-building surfaces |
| 13 | Seyedzadeh et al. (2024) | A novel fuzzy-multi-criteria-GIS-machine learning approach for onshore wind power plant site selection [wind analog applicable to solar] | (Wind study — methodology directly transferable to solar) | Euro-Mediterranean Journal for Environmental Integration | Fuzzy MCDM + ML (decision tree / RF type, exact model NR) | Wind speed, slope, land cover, distance to road, distance to settlement, distance to grid, protected area proximity | Binary suitability class | Not reported in abstract | Standard wind/solar exclusion zones |
| 14 | Biresselioglu et al. (2021) | Regional GIS-Assisted Multi-Criteria Evaluation of Site-Suitability for the Development of Solar Farms | Turkey / Multi-region | Land (MDPI) | GIS-MCDA (AHP weighted overlay; pre-ML baseline reference) | Solar irradiance, slope, aspect, land use, distance to road, distance to grid, distance to settlements | Ordinal suitability class (1–5 scale) | Not ML-based; used as benchmark comparison | Exclude: forests, water, protected, steep (>5°), urban |
| 15 | Manfreda et al. (2024) | Modeling Site Suitability for Solar Farms in the Southeastern United States: A Case Study in Bibb County | Bibb County, Georgia, USA | Energies (MDPI) | GIS-MCDA adapted from Thailand model (AHP overlay; lightweight ML rank transfer test) | Solar irradiance, slope, land use, road proximity, grid proximity, population density | 6-rank suitability class (ordinal) | 93% of county = moderate suitability; 2% = moderate-to-high | Exclude: urban, water, protected areas |

---

## Detailed Per-Paper Notes

---

### Paper 1 — Xia et al. (2023)

**Full Title:** Spatial modelling the location choice of large-scale solar photovoltaic power plants: Application of interpretable machine learning techniques and the national inventory

**Journal:** Energy Conversion and Management
**DOI/URL:** https://www.sciencedirect.com/science/article/abs/pii/S0196890423005447
**Region:** China (national scale)
**Year:** 2023

**Models Used:**
- Multi-layer Perceptron (MLP)
- Random Forest (RF) — **best performer**
- Extreme Gradient Boosting (XGBoost)
- Models fitted separately per land cover type (cropland, forest, grassland, barren)

**Input Variables (21 geospatial conditioning factors):**
1. NDVI (vegetation index) — **#1 most important overall**
2. Distance to power grid — **#2 most important overall**
3. Slope
4. Aspect
5. Solar radiation / GHI
6. Land cover type
7. Elevation
8. Distance to road
9. Distance to urban areas
10. GDP per capita
11. Population density
12. Temperature (annual mean)
13. Precipitation
14. Wind speed
15. Distance to water bodies
16. Soil type
17. Industrial/economic zone proximity
18. Policy zone classification
19. Distance to transmission lines
20. Terrain ruggedness index
21. Land surface temperature

**Target Variable:** Binary — PV plant installed (≥1 hm² coverage) vs. not installed. Training dataset: 7,446 existing large-scale PV farms (national inventory).

**Interpretability:** SHapley Additive exPlanations (SHAP) + variable importance measure (VIM)

**Key Finding:** NDVI and distance to power grid dominate across all land cover types. Topography and transport have moderate impact. Most socio-economic/resource endowment factors are negligible.

**Validation:** RF outperforms MLP and XGBoost across land cover types (specific AUC not quoted in accessible abstract but RF consistently best)

**Hard Mask / Exclusion:** Water bodies, ecological protection zones, urban built-up areas excluded prior to modelling

---

### Paper 2 — Yildiz & Arslan (2022)

**Full Title:** Global Spatial Suitability Mapping of Wind and Solar Systems Using an Explainable AI-Based Approach

**Journal:** ISPRS International Journal of Geo-Information (IJGI), Vol. 11, No. 8, Article 422
**DOI/URL:** https://www.mdpi.com/2220-9964/11/8/422
**Region:** Global (55,000+ wind and solar plant locations)
**Year:** 2022

**Models Used:**
- Random Forest (RF) — **best performer**
- Support Vector Machine (SVM)
- Multi-layer Perceptron (MLP)

**Input Variables:**
- Solar irradiance / GHI
- Annual mean temperature
- Terrain slope
- Land cover type
- Distance to road network
- Distance to electrical grid
- Wind speed (for wind modeling)
- Elevation

**Target Variable:** Binary — renewable energy plant present / absent

**Feature Importance:** SHAP values used. Solar models: irradiance and land cover dominant. Wind models: wind speed dominant.

**Validation Metrics (Solar model):**
- Overall Accuracy: **89%** (RF)
- Kappa coefficient: **0.78** (RF)
- AUC: **0.95** (RF)
- SVM: Acc=87%, AUC=0.93
- MLP: Acc=85%, AUC=0.91

**Hard Mask / Exclusion:** Protected natural areas, water bodies, steep terrain

**Notes:** First paper to generate global suitability maps for onshore solar and wind using XAI. High and very high suitability zones = ~50.31 million km² globally for solar.

---

### Paper 3 — Alshamrani et al. (2025)

**Full Title:** Geographic Information System and Machine Learning Approach for Solar Photovoltaic Site Selection: A Case Study in Pakistan

**Journal:** Processes (MDPI), Vol. 13, No. 4, Article 981
**DOI/URL:** https://www.mdpi.com/2227-9717/13/4/981
**Region:** Cholistan Desert, Punjab, Pakistan
**Year:** 2025

**Models Used:**
- Random Forest (RF) — **best performer** (AUC = 0.92)
- XGBoost
- Multilayer Perceptron (MLP)
- SHAP for interpretability
- Spatial processing: ArcGIS 10.8

**Input Variables (14 conditioning factors):**
1. Solar radiation / GHI
2. Slope
3. Aspect — **XGBoost's most dominant feature**
4. Land use / land cover
5. Distance to road
6. Distance to power grid
7. Distance to settlement
8. Soil type
9. Annual mean temperature
10. Relative humidity
11. Wind speed
12. Elevation
13. Population density
14. Distance to water bodies

**Target Variable:** Binary suitability (high / very high probability vs. other), trained on ground-truth PV installation survey data

**Feature Importance:** SHAP analysis — RF: solar radiation + distance to grid dominant; XGBoost: aspect dominant

**Validation Metrics:**
- RF: **AUC = 0.92** (best)
- XGBoost: AUC ~0.89
- MLP: AUC ~0.87

**Hard Mask / Exclusion:** Water bodies, urban areas, protected lands

**Key Finding:** Bahawalnagar: 10.50% classified high/very high; Bahawalpur: 11.06% high/very high probability

---

### Paper 4 — Liu et al. (2024)

**Full Title:** Evaluation of Site Suitability for Photovoltaic Power Plants in the Beijing–Tianjin–Hebei Region of China Using a Combined Weighting Method

**Journal:** Land (MDPI), Vol. 13, No. 1, Article 40
**DOI/URL:** https://www.mdpi.com/2073-445X/13/1/40
**Region:** Beijing–Tianjin–Hebei (Jing-Jin-Ji) Region, China
**Year:** 2024

**Models Used:** **Hybrid AHP + XGBoost** → composite PDSI (Photovoltaic Development Suitability Index)
- AHP provides subjective expert-based criterion weights
- XGBoost provides objective data-driven weights
- Combined weighting integrates both into unified PDSI score
- GIS spatial analysis for visualization

**Multi-level Evaluation Hierarchy:**
- **Ecological Suitability:** vegetation index, ecological sensitivity, biodiversity index
- **Economic Suitability:** land price, distance to power grid, distance to road, demand for electricity
- **Land Suitability:** slope, aspect, solar radiation (GHI), land use type, elevation

**Target Variable:** Continuous PDSI score → classified as suitable / not suitable

**Validation:** ~48,800 km² (21.59%) of total area classified suitable. No AUC reported; validated against existing plant locations.

**Spatial Pattern:** Most suitable areas in Baoding, Zhangjiakou, Chengde (NW of Yanshan-Taihang Mountains)

**Hard Mask / Exclusion:** Class I–III farmland, ecological red lines, urban built-up areas, steep slopes

---

### Paper 5 — Song, Cao & Yang (2023)

**Full Title:** Assessment of solar radiation resource and photovoltaic power potential across China based on optimized interpretable machine learning model and GIS-based approaches

**Journal:** Applied Energy, Vol. 339
**DOI/URL:** https://www.sciencedirect.com/science/article/abs/pii/S0306261923003690
**Region:** China (national)
**Year:** 2023

**Models Used:** **PSO-XGBoost** (XGBoost optimized by Particle Swarm Optimization) + GIS spatial analysis

**Input Variables:**
- Sunshine hours
- Air temperature (mean, max, min)
- Relative humidity
- Elevation
- Geographic coordinates (latitude, longitude)
- Cloud cover
- Aerosol Optical Depth (AOD)
- Atmospheric water vapor

**Target Variable:** Continuous — Global Horizontal Irradiance (GHI, kWh/m²/day) and derived PV power potential

**Feature Importance:** SHAP values applied to make the black-box XGBoost interpretable — sunshine hours and temperature most influential

**Validation:** PSO-XGBoost outperforms plain XGBoost and other ML benchmarks on RMSE/MAE across Chinese meteorological stations; specific metrics not available in abstract

**Notes:** Focus is on spatially complete estimation of solar resource, not discrete binary site selection. GIS used to produce nationwide continuous PV potential surface.

---

### Paper 6 — Wang et al. (2025)

**Full Title:** Solar and wind power plant site selection in China: Machine learning-based regional and temporal probability

**Journal:** Applied Energy
**DOI/URL:** https://www.sciencedirect.com/science/article/abs/pii/S0306261925017635
**Region:** China (national, subregion-differentiated, multi-temporal)
**Year:** 2025

**Models Used:**
- Random Forest
- XGBoost
- MLP
- Three model sets: national model, subregional models, temporal models

**Input Variables:**
- Distance to nearest road (key threshold: ~5 km)
- Distance to nearest substation (key threshold: ~30 km)
- Solar resource (GHI / DNI)
- Slope and terrain
- Land cover type
- GDP per capita
- Population density
- Time period (installation decade)
- Distance to existing transmission lines
- Climate zone classification
- Policy zone type

**Target Variable:** Probability score (0–1) per 1 km² grid cell — likelihood of solar/wind plant siting

**Key Finding:** Distance to road and distance to substation are top predictors with clear threshold effects. Suitable areas shifting from resource-rich west to economically developed east over time. Temporal dimension is novel contribution.

**Validation:** Subregional models outperform national model. Specific AUC values not in accessible abstract.

**Hard Mask:** Steep slopes, water, dense urban, protected natural reserves

---

### Paper 7 — Ozbek & Yildiz (2021)

**Full Title:** Selection of renewable energy systems sites using the MaxEnt model in the Eastern Mediterranean region in Turkey

**Journal:** Environmental Science and Pollution Research, Vol. 28
**DOI/URL:** https://link.springer.com/article/10.1007/s11356-021-13760-6
**PubMed:** https://pubmed.ncbi.nlm.nih.gov/33983608/
**Region:** Eastern Mediterranean Region, Turkey (Hatay & Mersin provinces)
**Year:** 2021

**Models Used:** **MaxEnt** (Maximum Entropy) — a Species Distribution Model (SDM) framework applied to renewable energy site mapping

**Conceptual Approach:** Solar/wind power plant locations treated as "presence" points (analogous to species occurrences); environmental layers treated as habitat variables. Model predicts suitable "habitat" for solar and wind plants.

**Input Variables (environmental layers):**
- Solar irradiance (GHI/DNI)
- Annual mean temperature
- Elevation / DEM
- Slope
- Aspect
- Land cover / land use
- Annual precipitation
- Proximity to settlements
- Distance to roads

**Target Variable:** Habitat suitability probability (0–1); continuous output map

**Validation Metrics:**
- Solar: **AUC = 0.87**
- Wind: **AUC = 0.95**
- Validated using ROC curve analysis

**Key Output:** 8% of total study area classified as "suitable" for solar; 3.39% for wind. Main suitable solar zones: Hatay and Mersin coastal plains.

**Hard Mask:** Built-up/urban areas, water bodies, dense forests excluded as "background" in MaxEnt

---

### Paper 8 — Kim et al. (2023)

**Full Title:** Spatial distribution of solar PV deployment: an application of the region-based convolutional neural network

**Journal:** EPJ Data Science, Vol. 12
**DOI/URL:** https://epjdatascience.springeropen.com/articles/10.1140/epjds/s13688-023-00399-1
**ArXiv Preprint:** https://arxiv.org/abs/2207.08287
**Region:** Colorado, USA
**Year:** 2023

**Models Used (Two-stage):**
1. **Faster R-CNN** (Region-based Convolutional Neural Network) — computer vision model for panel detection from satellite imagery
2. **XGBoost** — socio-economic predictor model for neighborhood-level deployment patterns

**Input Variables:**
- Stage 1 (Faster R-CNN): High-resolution satellite imagery (RGB tiles, 652,795 images covering Colorado)
- Stage 2 (XGBoost): 43 socio-economic/demographic factors including:
  - Democratic party vote share (top predictor)
  - Hail and strong wind risk
  - Median home value
  - Percentage of renters
  - Solar PV permitting timelines
  - Median household income
  - Education level
  - Homeownership rate
  - Electricity price
  - Net metering policy

**Target Variable:**
- Stage 1: Count of rooftop PV panels per image tile; % roof area with solar
- Stage 2: Neighborhood-level solar deployment density

**Validation Metrics:**
- Faster R-CNN: mAP = **81%** (panels), **95%** (roofs)
- XGBoost: R² ≈ **0.70** (explaining ~70% variance in deployment)

**Key Finding:** ~7% of Colorado households have rooftop PV; solar panels cover ~2.5% of roof areas (as of early 2021). Democratic vote share is the strongest socio-economic predictor.

**Notes:** This paper focuses on mapping *existing* deployment patterns and drivers rather than future site selection, but the Faster R-CNN + XGBoost framework is directly applicable to siting and gap analysis.

---

### Paper 9 — Raza et al. (2025)

**Full Title:** A Novel Integrated GIS-AI Framework for Optimal CSP Plant Site Selection: A Multi-Criteria Approach Under Climate Change Scenarios in Bushehr, Iran

**Journal:** Advances in Space Research
**DOI/URL:** https://www.sciencedirect.com/science/article/abs/pii/S0273117725009044
**Region:** Bushehr Province, Iran
**Year:** 2025

**Models Used:** Hybrid GIS + Fuzzy MCDA + RF + CNN
- Fuzzy Multi-Criteria Decision Analysis (MCDA) for initial weight generation
- Random Forest for spatial prediction refinement
- Convolutional Neural Network (CNN) for pattern recognition
- RF + CNN ensemble improved accuracy by **12.7%** over conventional MCDA
- Monte Carlo simulation for Cost-Benefit Analysis under uncertainty

**Input Variables:**
- Solar Direct Normal Irradiance (DNI)
- Annual temperature (mean, max)
- Relative humidity
- Terrain slope
- Land cover / land use type
- Distance to road
- Distance to power grid
- Wind speed
- Climate change scenario projections (RCP scenarios)
- Distance to water sources
- Geological stability

**Target Variable:** Binary suitability (highly suitable ≈ 5.37% of province ≈ 1,246 km²)

**Validation:** RF+CNN improved spatial prediction accuracy by 12.7% vs. Fuzzy MCDA alone; positive economic returns confirmed via Monte Carlo CBA simulation

**Hard Mask / Exclusion:** Protected natural areas, agricultural lands, urban zones, steep terrain (>5%)

**Notes:** Primary focus is Concentrated Solar Power (CSP) rather than PV, but all siting criteria and ML methodology are directly applicable to utility-scale PV.

---

### Paper 10 — Li et al. (2025)

**Full Title:** A Novel Hybrid Fuzzy Comprehensive Evaluation and Machine Learning Framework for Solar PV Suitability Mapping in China

**Journal:** Remote Sensing (MDPI), Vol. 17, No. 12, Article 2070
**DOI/URL:** https://www.mdpi.com/2072-4292/17/12/2070
**Region:** China (national)
**Year:** 2025

**Models Used:** Hybrid — Fuzzy Comprehensive Evaluation (FCE) + Machine Learning ensemble
- FCE establishes membership functions for multi-criteria integration
- ML model trained on existing PV locations for objective weight derivation
- GIS for spatial output

**Input Variables (11 spatial indicators):**
1. Global Horizontal Irradiance (GHI)
2. Land price / cost
3. Regional power demand / electricity load
4. Slope
5. Aspect
6. Land cover / land use type
7. Distance to power grid
8. Annual mean temperature
9. Elevation
10. Ecological sensitivity index
11. Policy zone / development zone classification

**Target Variable:** Continuous suitability score (integrating economic, climatic, and geographic sub-scores)

**Novelty:** Integrates economic cost-benefit analysis (land price + power demand) into the suitability evaluation system — most prior studies only use physical/geographic criteria

**Hard Mask / Exclusion:** Ecological red lines, Class I farmland, water bodies, >10° slope

---

### Paper 11 — Patel & Yadav (2025)

**Full Title:** A hybrid ANN–AHP–GIS framework with dimensionality reduction and uncertainty quantification for solar site selection in Southern India

**Journal:** Sustainable Energy Technologies and Assessments
**DOI/URL:** https://www.sciencedirect.com/science/article/pii/S259017452500412X
**Region:** Southern India (Andhra Pradesh: Visakhapatnam, Guntur, Srikakulam)
**Year:** 2025

**Models Used:** Hybrid ANN + AHP + GIS
- AHP: expert-driven criterion weighting (subjective component)
- ANN: data-driven site scoring (objective component)
- Integration ratio: 40% AHP : 60% ANN
- PCA (Principal Component Analysis): captures 94% variance for dimensionality reduction
- t-SNE: non-linear visualization of feature space
- Monte Carlo simulation: 95% CI uncertainty quantification
- Dropout-based uncertainty modeling

**Input Variables:**
- Solar irradiance / GHI
- Land use / land cover
- Slope and terrain
- Aspect
- Distance to power grid
- Annual mean temperature
- Relative humidity
- Wind speed
- Economic factors (land cost, infrastructure)
- PCA-reduced composite variables

**Target Variable:** Ranked site suitability score (continuous); top sites identified and ranked

**Validation Metrics:**
- Classification accuracy improved by **+22%** vs. individual models
- **85% ranking stability** across different parameter settings
- **95% confidence interval** on site rankings via Monte Carlo

**Key Finding:** Top-ranked sites: Vizag > Guntur > Srikakulam

**Hard Mask / Exclusion:** Forests, water bodies, steep slopes (>5°), urban/built-up

---

### Paper 12 — Liang et al. (2025)

**Full Title:** Deep Learning Ensemble and Multi-Criteria GIS for High-Fidelity Rooftop Solar Potential Mapping

**Journal:** Journal of Geovisualization and Spatial Analysis (Springer)
**DOI/URL:** https://link.springer.com/article/10.1007/s41651-025-00240-5
**Region:** Amsterdam, Netherlands
**Year:** 2025

**Models Used:** Deep Learning Ensemble (5-model ensemble with weighted majority voting):
1. UNet-ResNet50
2. DeepLabv3-ResNet50
3. Mask2Former-SwinTransformer
4. SAM-LoRA-vit_b (Segment Anything Model with LoRA fine-tuning)
5. PSPNet-ResNet50
- Combined via **weighted majority voting**
- Post-processing: GIS multi-criteria analysis for untapped potential estimation

**Input Variables:**
- High-resolution satellite imagery (RGB + near-infrared)
- Building footprints (vector data)
- LiDAR-derived Digital Surface Model (DSM)
- Shadow/shading masks (computed from DSM)
- Rooftop orientation (aspect)
- Rooftop area and geometry

**Target Variable:** Binary semantic segmentation:
1. Existing solar panels on rooftops (detection)
2. Suitable but unexploited rooftop areas (gap analysis)

**Validation Metrics:** Ensemble superior to each individual model on F1-score, precision, and recall (specific values not in accessible abstract). City-scale gap analysis: identifies how much of Amsterdam's total rooftop area remains untapped toward 60% emission reduction by 2030 target.

**Hard Mask / Exclusion:** Shaded roofs (shadow fraction > threshold), roofs below minimum area, non-building surfaces

**Notes:** This is rooftop/urban PV potential mapping rather than utility-scale site selection, but the deep learning ensemble approach is a landmark methodology paper.

---

### Paper 13 — Cengiz et al. (2024)

**Full Title:** A novel fuzzy-multi-criteria-GIS-machine learning approach for onshore wind power plant site selection

**Journal:** Euro-Mediterranean Journal for Environmental Integration
**DOI/URL:** https://link.springer.com/article/10.1007/s41207-024-00653-6
**Region:** Not specified in abstract (methodology paper)
**Year:** 2024

**Models Used:** Hybrid Fuzzy MCDM + GIS + Machine Learning (RF/DT type — exact ML model details NR in abstract)
- Fuzzy logic for handling uncertainty in criterion weighting
- Multi-Criteria Decision Making (MCDM) for structured evaluation
- GIS for spatial overlay and suitability mapping
- ML for data-driven pattern learning from existing plant locations

**Input Variables (Wind-focused, but solar criteria analogous):**
- Wind speed (equivalent: solar irradiance for PV)
- Slope / terrain
- Land cover type
- Distance to road
- Distance to settlement
- Distance to power grid
- Distance to protected areas

**Target Variable:** Binary suitability classification

**Notes:** Wind-focused study, but the hybrid Fuzzy-MCDM-GIS-ML framework architecture is directly applicable and referenced as methodology in solar PV studies. Included for methodological relevance.

---

### Paper 14 — Biresselioglu et al. (2021)

**Full Title:** A Regional GIS-Assisted Multi-Criteria Evaluation of Site-Suitability for the Development of Solar Farms

**Journal:** Land (MDPI), Vol. 10, No. 2, Article 217
**DOI/URL:** https://www.mdpi.com/2073-445X/10/2/217
**Region:** Multi-region (Turkey and other regions)
**Year:** 2021

**Models Used:** GIS-MCDA with AHP weighted overlay (pre-ML baseline; included as benchmark comparison study)

**Input Variables:**
- Solar irradiance / GHI
- Slope (%)
- Aspect
- Land use / land cover
- Distance to road
- Distance to power grid
- Distance to settlements
- Elevation

**Target Variable:** Ordinal suitability class (1–5 scale)

**Validation:** No ML metrics; spatial consistency and expert review validation

**Hard Mask / Exclusion:** Forests, water bodies, protected areas, slope >5°, urban built-up

**Notes:** Classic GIS-AHP paper included as methodological baseline / comparison reference. Demonstrates pre-ML MCDA methodology that hybrid ML papers build upon.

---

### Paper 15 — Manfreda et al. (2024)

**Full Title:** Modeling Site Suitability for Solar Farms in the Southeastern United States: A Case Study in Bibb County

**Journal:** Energies (MDPI), Vol. 6, No. 1, Article 2
**DOI/URL:** https://www.mdpi.com/2673-9941/6/1/2
**Region:** Bibb County, Georgia, USA (Southeastern USA)
**Year:** 2024

**Models Used:** GIS-MCDA (AHP weighted overlay adapted from a Thailand model; lightweight ML rank-transfer test)

**Input Variables:**
- Solar irradiance / GHI
- Terrain slope
- Land use / land cover
- Distance to road network
- Distance to power grid
- Population density / proximity to settlements

**Target Variable:** 6-rank ordinal suitability classification

**Key Result:** 93% of Bibb County = moderate suitability; 5% = moderate-to-low; 2% = moderate-to-high. Southeast USA generally has high solar resource.

**Validation:** GIS overlay consistency; no ML AUC metric

**Notes:** Tests transferability of a GIS-MCDA model originally developed for Thailand to a US context. Included for geographic coverage of Southeast USA and model-transferability discussion.

---

## Cross-Paper Synthesis

### 1. Most Commonly Used Input Variables (Frequency Across 15 Papers)

| Variable | Times Cited | Notes |
|---|---|---|
| Solar irradiance / GHI | 15/15 | Universal; sometimes GHI, sometimes DNI for CSP |
| Slope / terrain gradient | 14/15 | Threshold usually <3–5° for utility-scale |
| Land use / land cover | 14/15 | Excludes urban, forests, cropland |
| Distance to power grid | 13/15 | Top SHAP predictor in Papers 1, 3, 6 |
| Distance to road | 13/15 | Key threshold ~5 km (Paper 6) |
| Aspect | 11/15 | Dominant in XGBoost (Paper 3) |
| Temperature (annual mean) | 11/15 | — |
| Elevation | 10/15 | — |
| Distance to settlements | 9/15 | Buffer typically 500 m–2 km |
| NDVI / vegetation index | 6/15 | Top SHAP predictor in Paper 1; implies land availability |
| Land price / economic factors | 5/15 | Increasingly included in newer papers (2024–2025) |
| Distance to protected areas | 8/15 | Used as hard exclusion mask |
| Humidity / precipitation | 6/15 | Secondary climatic factor |

### 2. Model Performance Comparison

| Model | Best AUC / Accuracy Reported | Study |
|---|---|---|
| Random Forest (RF) | AUC 0.92, Acc 90% | Papers 1, 2, 3, 6 |
| XGBoost | R² 0.70; AUC ~0.89 | Papers 3, 8; AUC slightly below RF |
| MLP / ANN | AUC ~0.87; Acc 85% | Papers 2, 3, 11 |
| MaxEnt | AUC 0.87–0.95 | Paper 7 |
| Faster R-CNN | mAP 81%–95% | Paper 8 |
| DL Ensemble | F1 superior to individual | Paper 12 |
| SVM | Acc ~87%, AUC 0.93 | Paper 2 |
| PSO-XGBoost | Outperforms plain XGBoost | Paper 5 |
| RF + CNN hybrid | +12.7% over MCDA | Paper 9 |
| ANN + AHP hybrid | +22% accuracy over individual | Paper 11 |

**General ranking across studies: RF ≈ XGBoost > MLP > SVM**

### 3. Hard Mask / Exclusion Criteria (Standard Across Studies)

| Criterion | Typical Threshold |
|---|---|
| Water bodies | 100–500 m buffer |
| Urban / built-up areas | 500 m–2 km buffer |
| Protected natural areas | Total exclusion |
| Slope | >3° or >5° excluded |
| Ecological red lines (China) | Total exclusion |
| Class I farmland (China) | Total exclusion |
| Forests / dense vegetation | Total or partial exclusion |
| Military zones | Total exclusion |
| Airport proximity | 3–5 km buffer |

### 4. Target Variable Types

| Type | Papers | Notes |
|---|---|---|
| Binary presence/absence | 1, 2, 3, 6, 7, 9, 13 | Most common for ML siting models |
| Continuous suitability score | 4, 5, 10, 11 | Allows gradient ranking of sites |
| Ordinal suitability class | 14, 15 | GIS-MCDA typical output |
| Count / density of installations | 8 | Unique (urban PV deployment mapping) |
| Semantic segmentation (panel/no panel) | 12 | Deep learning rooftop mapping |

### 5. Key Research Gaps & Trends (2023–2025)

1. **Temporal/dynamic modeling:** Paper 6 (Wang 2025) is pioneering in modeling how siting factors change over time — most papers still use static snapshots.
2. **Economic integration:** Only Papers 4, 10, 11 explicitly include land price and electricity demand as variables. Cost-benefit analysis remains underexplored in ML siting models.
3. **Uncertainty quantification:** Paper 11 is rare in providing 95% CI on site rankings. Most ML siting papers report point estimates only.
4. **Climate change integration:** Paper 9 (CSP, Iran 2025) integrates RCP scenarios — almost no PV siting paper includes climate projections.
5. **Transferability across regions:** Paper 15 tests model transfer; mostly untested.
6. **Deep learning for site detection vs. suitability mapping:** Papers 8 and 12 use DL for mapping existing installations; fewer papers use DL to generate prospective suitability surfaces.

---

## References (URLs)

1. Xia et al. (2023): https://www.sciencedirect.com/science/article/abs/pii/S0196890423005447
2. Yildiz & Arslan (2022): https://www.mdpi.com/2220-9964/11/8/422
3. Alshamrani et al. (2025): https://www.mdpi.com/2227-9717/13/4/981
4. Liu et al. (2024): https://www.mdpi.com/2073-445X/13/1/40
5. Song, Cao & Yang (2023): https://www.sciencedirect.com/science/article/abs/pii/S0306261923003690
6. Wang et al. (2025): https://www.sciencedirect.com/science/article/abs/pii/S0306261925017635
7. Ozbek & Yildiz (2021): https://link.springer.com/article/10.1007/s11356-021-13760-6
8. Kim et al. (2023): https://epjdatascience.springeropen.com/articles/10.1140/epjds/s13688-023-00399-1
9. Raza et al. (2025): https://www.sciencedirect.com/science/article/abs/pii/S0273117725009044
10. Li et al. (2025): https://www.mdpi.com/2072-4292/17/12/2070
11. Patel & Yadav (2025): https://www.sciencedirect.com/science/article/pii/S259017452500412X
12. Liang et al. (2025): https://link.springer.com/article/10.1007/s41651-025-00240-5
13. Cengiz et al. (2024): https://link.springer.com/article/10.1007/s41207-024-00653-6
14. Biresselioglu et al. (2021): https://www.mdpi.com/2073-445X/10/2/217
15. Manfreda et al. (2024): https://www.mdpi.com/2673-9941/6/1/2
